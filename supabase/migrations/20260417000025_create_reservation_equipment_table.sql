CREATE TABLE IF NOT EXISTS "public"."reservation_equipment" (
    "reservation_id" "uuid" NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    CONSTRAINT "reservation_equipment_pkey" PRIMARY KEY ("reservation_id", "equipment_id"),
    CONSTRAINT "reservation_equipment_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE,
    CONSTRAINT "reservation_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE RESTRICT
);
