/*
  Warnings:

  - Added the required column `askPrice` to the `have_listings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bidPrice` to the `want_listings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "have_listings" ADD COLUMN     "askPrice" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "want_listings" ADD COLUMN     "bidPrice" INTEGER NOT NULL;
