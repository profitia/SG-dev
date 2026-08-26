-- CreateTable
CREATE TABLE "CognitionSnapshot" (
    "id" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CognitionSnapshot_pkey" PRIMARY KEY ("id")
);
