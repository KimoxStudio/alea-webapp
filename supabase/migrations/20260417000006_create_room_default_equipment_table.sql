CREATE TABLE IF NOT EXISTS "public"."room_default_equipment" (
    "room_id" "uuid" NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    CONSTRAINT "room_default_equipment_pkey" PRIMARY KEY ("room_id", "equipment_id"),
    CONSTRAINT "room_default_equipment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE,
    CONSTRAINT "room_default_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE
);
