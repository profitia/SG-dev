"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SupplierReportController } from "./report-controller";

export function useSupplierReport() {
  const [controller] = useState(() => new SupplierReportController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => () => controller.dispose(), [controller]);
  return { state, controller };
}
