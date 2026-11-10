-- CreateTable
CREATE TABLE "Knife" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "sortKey" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "scanCode" TEXT,
    "checkedOutById" INTEGER,
    "checkedOutAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Knife_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "KnifeEvent" (
    "id" SERIAL NOT NULL,
    "knifeId" INTEGER NOT NULL,
    "workerId" INTEGER,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnifeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Knife_number_key" ON "Knife"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Knife_scanCode_key" ON "Knife"("scanCode");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_pin_key" ON "Worker"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_badgeId_key" ON "Worker"("badgeId");

-- CreateIndex
CREATE INDEX "KnifeEvent_knifeId_idx" ON "KnifeEvent"("knifeId");

-- CreateIndex
CREATE INDEX "KnifeEvent_createdAt_idx" ON "KnifeEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Knife" ADD CONSTRAINT "Knife_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnifeEvent" ADD CONSTRAINT "KnifeEvent_knifeId_fkey" FOREIGN KEY ("knifeId") REFERENCES "Knife"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnifeEvent" ADD CONSTRAINT "KnifeEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
