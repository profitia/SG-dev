"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SupplierReportController } from "./report-controller";

export function useSupplierReport(transport:typeof fetch=fetch) {
  const current=useRef(transport);current.current=transport;
  const [controller] = useState(() => new SupplierReportController((input,init)=>current.current(input,init)));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => () => controller.dispose(), [controller]);
  return { state, controller };
}
