-- CreateTable
CREATE TABLE "rolling_daily_current_forecast_snapshots" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "inputSource" TEXT NOT NULL,
    "inputRunId" TEXT,
    "targetBasis" "ForecastTargetBasis" NOT NULL DEFAULT 'POINT_IN_TIME',
    "methodId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reasonCode" TEXT,
    "message" TEXT,
    "forecastOriginAt" TIMESTAMP(3),
    "sourceLatestObservationAt" TIMESTAMP(3),
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rolling_daily_current_forecast_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rolling_daily_current_forecast_snapshots_identity_key"
ON "rolling_daily_current_forecast_snapshots"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId");

-- CreateIndex
CREATE INDEX "rolling_daily_current_forecast_snapshots_updated_idx"
ON "rolling_daily_current_forecast_snapshots"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "updatedAt");