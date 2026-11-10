-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "sortKey" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "type" TEXT NOT NULL DEFAULT 'RADIO',
    "scanCode" TEXT,
    "damageNote" TEXT,
    "damagePhoto" TEXT,
    "checkedOutById" INTEGER,
    "checkedOutAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "badgeId" TEXT,
    "roles" TEXT NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceEvent" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "workerId" INTEGER,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_number_key" ON "Device"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Device_scanCode_key" ON "Device"("scanCode");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_pin_key" ON "Worker"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_badgeId_key" ON "Worker"("badgeId");

-- CreateIndex
CREATE INDEX "DeviceEvent_deviceId_idx" ON "DeviceEvent"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceEvent_createdAt_idx" ON "DeviceEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

