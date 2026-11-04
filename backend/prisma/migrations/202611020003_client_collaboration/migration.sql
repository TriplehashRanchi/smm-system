-- AlterTable
ALTER TABLE `ContentItem` ADD COLUMN `allowExternalFinalApproval` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `clientActionDueAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `ProductionApproval` ADD COLUMN `acknowledgement` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `feedback` TEXT NOT NULL DEFAULT '',
    ADD COLUMN `origin` VARCHAR(30) NOT NULL DEFAULT 'RECORDED_BY_AGENCY',
    ADD COLUMN `requestId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ApprovalRequest` (
    `id` VARCHAR(191) NOT NULL,
    `contentItemId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `title` VARCHAR(200) NOT NULL,
    `script` TEXT NOT NULL,
    `caption` TEXT NOT NULL,
    `creativeReference` TEXT NOT NULL,
    `summary` TEXT NOT NULL,
    `reviewLocation` VARCHAR(20) NOT NULL,
    `previewUrl` VARCHAR(2000) NOT NULL DEFAULT '',
    `dueAt` DATETIME(3) NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,

    INDEX `ApprovalRequest_contentItemId_status_createdAt_idx`(`contentItemId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentSuggestion` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    `response` TEXT NOT NULL DEFAULT '',
    `reviewedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContentSuggestion_clientId_createdAt_idx`(`clientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ProductionApproval_requestId_key` ON `ProductionApproval`(`requestId`);

-- AddForeignKey
ALTER TABLE `ProductionApproval` ADD CONSTRAINT `ProductionApproval_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_contentItemId_fkey` FOREIGN KEY (`contentItemId`) REFERENCES `ContentItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentSuggestion` ADD CONSTRAINT `ContentSuggestion_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentSuggestion` ADD CONSTRAINT `ContentSuggestion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentSuggestion` ADD CONSTRAINT `ContentSuggestion_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing pending Phase 3 reviews become actionable portal requests. Previous
-- decisions and Ready items remain unchanged; new final approvals default to portal.
INSERT INTO `ApprovalRequest` (`id`, `contentItemId`, `kind`, `version`, `title`, `script`, `caption`, `creativeReference`, `summary`, `reviewLocation`, `requestedById`)
SELECT CONCAT('review_', REPLACE(UUID(), '-', '')), `id`, 'SCRIPT', `scriptVersion`, `title`, `script`, `caption`, '',
  'Please review this script and approve it or explain the changes needed.', 'IN_APP', COALESCE(`ownerId`, `createdById`)
FROM `ContentItem` WHERE `scriptApprovalStatus` = 'PENDING' AND (`productionStage` = 'CLIENT_INPUT' OR (`productionStage` = 'ON_HOLD' AND `resumeStage` = 'CLIENT_INPUT'));
INSERT INTO `ApprovalRequest` (`id`, `contentItemId`, `kind`, `version`, `title`, `script`, `caption`, `creativeReference`, `summary`, `reviewLocation`, `requestedById`)
SELECT CONCAT('review_', REPLACE(UUID(), '-', '')), `id`, 'FINAL', `creativeVersion`, `title`, `script`, `caption`, `creativeReference`,
  'Please review this final version and caption, then approve or request changes.', IF(`contentType` = 'LINKEDIN_TEXT', 'IN_APP', 'WHATSAPP'), COALESCE(`ownerId`, `createdById`)
FROM `ContentItem` WHERE `finalApprovalStatus` = 'PENDING' AND (`productionStage` = 'CLIENT_FINAL_REVIEW' OR (`productionStage` = 'ON_HOLD' AND `resumeStage` = 'CLIENT_FINAL_REVIEW'));
