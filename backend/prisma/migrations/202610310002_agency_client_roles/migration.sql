-- Archive the previous internal roles before converting them.
INSERT INTO `ActivityEvent` (`id`, `actorId`, `clientId`, `eventType`, `details`, `createdAt`)
SELECT CONCAT('agency_role_', REPLACE(UUID(), '-', '')), `id`, NULL,
       'AGENCY_ROLE_MIGRATED',
       JSON_OBJECT('previousRole', `role`, 'newRole', 'AGENCY', 'source', 'two_role_migration'),
       CURRENT_TIMESTAMP(3)
FROM `User`
WHERE `role` IN ('ADMIN', 'TEAM_MEMBER');

-- Retain historical assignment data in the append-only activity timeline.
INSERT INTO `ActivityEvent` (`id`, `actorId`, `clientId`, `eventType`, `details`, `createdAt`)
SELECT CONCAT('agency_access_', REPLACE(UUID(), '-', '')), assignment.`userId`,
       assignment.`clientId`, 'AGENCY_ASSIGNMENT_ARCHIVED',
       JSON_OBJECT('assignedAt', assignment.`createdAt`, 'previousRole', agencyUser.`role`,
                   'source', 'two_role_migration', 'newAccess', 'ALL_CLIENTS'),
       CURRENT_TIMESTAMP(3)
FROM `TeamClientAssignment` AS assignment
INNER JOIN `User` AS agencyUser ON agencyUser.`id` = assignment.`userId`;

-- Expand first so existing user records are converted without invalid enum values.
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'TEAM_MEMBER', 'AGENCY', 'CLIENT') NOT NULL;
UPDATE `User` SET `role` = 'AGENCY', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `role` IN ('ADMIN', 'TEAM_MEMBER');
ALTER TABLE `User` MODIFY `role` ENUM('AGENCY', 'CLIENT') NOT NULL;

-- Agency users now have global access. ClientUserAccess mappings stay intact.
DROP TABLE `TeamClientAssignment`;
