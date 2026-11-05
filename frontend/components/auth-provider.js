"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onIdTokenChanged, signOut } from "@firebase/auth";
import { authMessage, getFirebaseAuth } from "../lib/firebase";

const AuthContext = createContext(null);
const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
// A page served over HTTPS cannot call an http:// API (mixed content), so upgrade remote addresses; localhost stays as is.
const apiBase = typeof window !== "undefined" && window.location.protocol === "https:" && /^http:\/\/(?!localhost|127\.0\.0\.1)/.test(configuredApiBase) ? configuredApiBase.replace(/^http:/, "https:") : configuredApiBase;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [accessStatus, setAccessStatus] = useState(null);
  const [accessRetryAt, setAccessRetryAt] = useState(0);
  const authGeneration = useRef(0);

  const api = useCallback(async (path, options = {}) => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) throw new Error("Please sign in to continue.");
    const requestGeneration = authGeneration.current;
    const assertCurrentSession = () => {
      if (requestGeneration !== authGeneration.current || getFirebaseAuth().currentUser?.uid !== currentUser.uid) {
        throw new Error("Your sign-in account changed. Please try again.");
      }
    };
    let token;
    try { token = await currentUser.getIdToken(); }
    catch (cause) {
      assertCurrentSession();
      const error = new Error(authMessage(cause));
      if (["auth/user-disabled", "auth/user-token-expired", "auth/invalid-user-token", "auth/user-not-found"].includes(cause.code)) {
        error.status = 401;
        setProfile(null);
        setAccessError(error.message);
        setAccessStatus(401);
        setAccessRetryAt(0);
      }
      throw error;
    }
    assertCurrentSession();
    let response;
    try {
      response = await fetch(`${apiBase}/api${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      });
    } catch {
      throw new Error(
        "The workspace could not be reached. Check your connection and try again.",
      );
    }
    assertCurrentSession();
    if (response.status === 204) return null;
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The workspace returned an unexpected response.");
    }
    assertCurrentSession();
    if (!response.ok) {
      const error = new Error(
        result.error || "The request could not be completed.",
      );
      error.status = response.status;
      error.code = result.code;
      error.retryAfter = Math.max(0, Math.min(3600, Number(result.retryAfter || response.headers.get("Retry-After")) || 0));
      if (response.status === 401 || result.code === "ACCOUNT_ACCESS_DENIED") {
        setProfile(null);
        setAccessError(error.message);
        setAccessStatus(response.status);
        setAccessRetryAt(0);
      }
      throw error;
    }
    return result;
  }, []);

  const refreshProfile = useCallback(async () => {
    const requestGeneration = authGeneration.current;
    const requestUid = getFirebaseAuth().currentUser?.uid;
    try {
      const result = await api("/me");
      if (requestGeneration !== authGeneration.current || requestUid !== getFirebaseAuth().currentUser?.uid) return;
      setProfile(result.data);
      setAccessError("");
      setAccessStatus(null);
      setAccessRetryAt(0);
      return result.data;
    } catch (error) {
      if (!profile && requestGeneration === authGeneration.current && requestUid === getFirebaseAuth().currentUser?.uid) {
        setAccessError(error.message);
        setAccessStatus(error.status || null);
        setAccessRetryAt(Date.now() + (error.retryAfter || 0) * 1000);
      }
      throw error;
    }
  }, [api, profile]);

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onIdTokenChanged(
      getFirebaseAuth(),
      async (currentUser) => {
        authGeneration.current++;
        const requestGeneration = ++generation;
        setUser(currentUser);
        setProfile(null);
        setAccessError("");
        setAccessStatus(null);
        setAccessRetryAt(0);
        setLoading(true);
        try {
          if (currentUser) {
            const result = await api("/me");
            if (requestGeneration === generation) setProfile(result.data);
          }
        } catch (error) {
          if (requestGeneration === generation) {
            setAccessError(error.message);
            setAccessStatus(error.status || null);
            setAccessRetryAt(Date.now() + (error.retryAfter || 0) * 1000);
          }
        } finally {
          if (requestGeneration === generation) setLoading(false);
        }
      },
    );
    return () => {
      generation++;
      unsubscribe();
    };
  }, [api]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        accessError,
        accessStatus,
        accessRetryAt,
        api,
        refreshProfile,
        logout: () => signOut(getFirebaseAuth()),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
