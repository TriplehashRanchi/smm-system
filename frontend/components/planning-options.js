"use client";
import { useEffect, useState } from 'react';
export function usePlanningOptions(api, revision = 0) {
  const [options, setOptions] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true; setError('');
    api('/planning/options').then((result) => { if (active) setOptions(result.data); }).catch((error) => { if (active) { setOptions(null); setError(error.message); } });
    return () => { active = false; };
  }, [api, revision]);
  return { options, error };
}
