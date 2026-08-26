-- CreateTable
CREATE TABLE "AiInterpretation" (
    "id" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInterpretation_pkey" PRIMARY KEY ("id")
);
