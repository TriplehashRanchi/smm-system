-- AlterTable
ALTER TABLE `ContentItem` ADD COLUMN `clientFeedback` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `creativeReference` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `creativeVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `finalApprovalStatus` ENUM('NOT_REQUIRED', 'NOT_REQUESTED', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED') NOT NULL DEFAULT 'NOT_REQUESTED',
    ADD COLUMN `finalApprovedVersion` INTEGER NULL,
    ADD COLUMN `footageStatus` ENUM('NOT_REQUIRED', 'NOT_SENT', 'REPORTED_SENT', 'VERIFIED_RECEIVED', 'NEEDS_MORE') NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN `handoffVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `holdReason` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `internalProductionNotes` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `productionStage` ENUM('PLANNED', 'DRAFTING', 'CLIENT_INPUT', 'PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY', 'ON_HOLD', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    ADD COLUMN `qaNote` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `qaStatus` ENUM('NOT_STARTED', 'FAILED', 'PASSED') NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN `qaVersion` INTEGER NULL,
    ADD COLUMN `requiresFinalApproval` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `requiresFootage` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `requiresScriptApproval` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `resumeStage` ENUM('PLANNED', 'DRAFTING', 'CLIENT_INPUT', 'PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY', 'ON_HOLD', 'CANCELLED') NULL,
    ADD COLUMN `scriptApprovalStatus` ENUM('NOT_REQUIRED', 'NOT_REQUESTED', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED') NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN `scriptApprovedVersion` INTEGER NULL,
    ADD COLUMN `scriptVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `shootAt` DATETIME(3) NULL,
    ADD COLUMN `shootCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `shootStatus` ENUM('NOT_REQUIRED', 'NOT_STARTED', 'SCHEDULED', 'RECORDED') NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN `verifiedFootageVersion` INTEGER NULL;

-- CreateTable
CREATE TABLE `ContentRevision` (
    `id` VARCHAR(191) NOT NULL,
    `contentItemId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `version` INTEGER NOT NULL,
    `script` TEXT NOT NULL,
    `caption` TEXT NOT NULL,
    `creativeReference` TEXT NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ContentRevision_contentItemId_kind_version_key`(`contentItemId`, `kind`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaHandoff` (
    `id` VARCHAR(191) NOT NULL,
    `contentItemId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `channelName` VARCHAR(160) NOT NULL,
    `senderName` VARCHAR(160) NOT NULL,
    `description` TEXT NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `clipCount` INTEGER NULL,
    `messageReference` TEXT NOT NULL,
    `reportedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verificationStatus` ENUM('NOT_REQUIRED', 'NOT_SENT', 'REPORTED_SENT', 'VERIFIED_RECEIVED', 'NEEDS_MORE') NOT NULL DEFAULT 'REPORTED_SENT',
    `verificationNote` TEXT NOT NULL DEFAULT '',
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,

    UNIQUE INDEX `MediaHandoff_contentItemId_sequence_key`(`contentItemId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionApproval` (
    `id` VARCHAR(191) NOT NULL,
    `contentItemId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `version` INTEGER NOT NULL,
    `decision` ENUM('NOT_REQUIRED', 'NOT_REQUESTED', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED') NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `reference` TEXT NOT NULL,
    `recordedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductionApproval_contentItemId_createdAt_idx`(`contentItemId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ContentItem_productionStage_dueAt_idx` ON `ContentItem`(`productionStage`, `dueAt`);

-- AddForeignKey
ALTER TABLE `ContentRevision` ADD CONSTRAINT `ContentRevision_contentItemId_fkey` FOREIGN KEY (`contentItemId`) REFERENCES `ContentItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentRevision` ADD CONSTRAINT `ContentRevision_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaHandoff` ADD CONSTRAINT `MediaHandoff_contentItemId_fkey` FOREIGN KEY (`contentItemId`) REFERENCES `ContentItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaHandoff` ADD CONSTRAINT `MediaHandoff_reportedById_fkey` FOREIGN KEY (`reportedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaHandoff` ADD CONSTRAINT `MediaHandoff_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionApproval` ADD CONSTRAINT `ProductionApproval_contentItemId_fkey` FOREIGN KEY (`contentItemId`) REFERENCES `ContentItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionApproval` ADD CONSTRAINT `ProductionApproval_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing planning records receive conservative production defaults. A planning
-- Approved label never substitutes for version-specific production approvals.
UPDATE `ContentItem` SET `requiresScriptApproval` = true, `requiresFootage` = true,
  `scriptApprovalStatus` = 'NOT_REQUESTED', `shootStatus` = 'NOT_STARTED', `footageStatus` = 'NOT_SENT'
WHERE `contentType` = 'REEL';
UPDATE `ContentItem` SET `productionStage` = 'CANCELLED' WHERE `status` = 'CANCELLED';
INSERT INTO `ContentRevision` (`id`, `contentItemId`, `kind`, `version`, `script`, `caption`, `creativeReference`, `createdById`, `createdAt`)
SELECT CONCAT('script_', REPLACE(UUID(), '-', '')), `id`, 'SCRIPT', 1, `script`, `caption`, '', `createdById`, `updatedAt` FROM `ContentItem`;
INSERT INTO `ContentRevision` (`id`, `contentItemId`, `kind`, `version`, `script`, `caption`, `creativeReference`, `createdById`, `createdAt`)
SELECT CONCAT('creative_', REPLACE(UUID(), '-', '')), `id`, 'CREATIVE', 1, `script`, `caption`, '', `createdById`, `updatedAt` FROM `ContentItem`;
