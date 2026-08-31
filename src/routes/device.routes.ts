import { Router } from "express";
import {
  consumeDevicePairingSession,
  createDevicePairingSession,
  listDevices,
  removeDevice,
  renameDevice,
} from "@/controllers/device.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  consumePairingSessionSchema,
  createPairingSessionSchema,
  deviceIdParamSchema,
  renameDeviceSchema,
} from "@/validators/device.validators.ts";

export const deviceRouter = Router();

deviceRouter.use(requireAuth);

deviceRouter.get("/", listDevices);
deviceRouter.patch("/:deviceId", validate({ params: deviceIdParamSchema, body: renameDeviceSchema }), renameDevice);
deviceRouter.delete("/:deviceId", validate({ params: deviceIdParamSchema }), removeDevice);

deviceRouter.post(
  "/pairing-sessions",
  validate({ body: createPairingSessionSchema }),
  createDevicePairingSession
);
deviceRouter.post(
  "/pairing-sessions/consume",
  validate({ body: consumePairingSessionSchema }),
  consumeDevicePairingSession
);
