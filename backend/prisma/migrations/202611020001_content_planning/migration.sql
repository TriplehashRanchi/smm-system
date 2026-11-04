CREATE TABLE `ContentIdea` (
  `id` VARCHAR(191) NOT NULL, `clientId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(200) NOT NULL, `brief` TEXT NOT NULL, `notes` TEXT NOT NULL,
  `bucket` VARCHAR(120) NOT NULL DEFAULT '', `campaign` VARCHAR(120) NOT NULL DEFAULT '',
  `createdById` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `ContentIdea_clientId_createdAt_idx` (`clientId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ContentItem` (
  `id` VARCHAR(191) NOT NULL, `ideaId` VARCHAR(191) NOT NULL, `socialAccountId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(200) NOT NULL, `contentType` VARCHAR(40) NOT NULL, `script` TEXT NOT NULL, `caption` TEXT NOT NULL,
  `publishAt` DATETIME(3) NULL, `dueAt` DATETIME(3) NULL,
  `status` ENUM('DRAFT','TENTATIVE','IN_PROGRESS','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `priority` ENUM('LOW','NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
  `ownerId` VARCHAR(191) NULL, `contributorId` VARCHAR(191) NULL, `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `ContentItem_ideaId_idx` (`ideaId`),
  INDEX `ContentItem_socialAccountId_publishAt_idx` (`socialAccountId`, `publishAt`), INDEX `ContentItem_publishAt_status_idx` (`publishAt`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CalendarNote` (
  `id` VARCHAR(191) NOT NULL, `clientId` VARCHAR(191) NOT NULL, `title` VARCHAR(200) NOT NULL,
  `body` TEXT NOT NULL, `date` DATE NOT NULL, `kind` VARCHAR(30) NOT NULL DEFAULT 'OTHER',
  `clientVisible` BOOLEAN NOT NULL DEFAULT false, `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `CalendarNote_clientId_date_idx` (`clientId`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `ContentIdea` ADD CONSTRAINT `ContentIdea_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContentIdea_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ContentItem` ADD CONSTRAINT `ContentItem_ideaId_fkey` FOREIGN KEY (`ideaId`) REFERENCES `ContentIdea`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContentItem_socialAccountId_fkey` FOREIGN KEY (`socialAccountId`) REFERENCES `SocialAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContentItem_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContentItem_contributorId_fkey` FOREIGN KEY (`contributorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContentItem_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CalendarNote` ADD CONSTRAINT `CalendarNote_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `CalendarNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ActivityEvent` ADD COLUMN `contentItemId` VARCHAR(191) NULL,
  ADD INDEX `ActivityEvent_contentItemId_createdAt_idx` (`contentItemId`, `createdAt`),
  ADD CONSTRAINT `ActivityEvent_contentItemId_fkey` FOREIGN KEY (`contentItemId`) REFERENCES `ContentItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
