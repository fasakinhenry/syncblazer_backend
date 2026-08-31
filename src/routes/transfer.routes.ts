import { Router } from "express";
import {
  createTransfer,
  getTransfer,
  listTransfers,
  retryTransfer,
  updateTransferStatus,
} from "@/controllers/transfer.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  createTransferSchema,
  listTransfersQuerySchema,
  transferIdParamSchema,
  updateTransferStatusSchema,
} from "@/validators/transfer.validators.ts";

export const transferRouter = Router();

transferRouter.use(requireAuth);

transferRouter.get("/", validate({ query: listTransfersQuerySchema }), listTransfers);
transferRouter.post("/", validate({ body: createTransferSchema }), createTransfer);
transferRouter.get("/:transferId", validate({ params: transferIdParamSchema }), getTransfer);
transferRouter.patch(
  "/:transferId/status",
  validate({ params: transferIdParamSchema, body: updateTransferStatusSchema }),
  updateTransferStatus
);
transferRouter.post("/:transferId/retry", validate({ params: transferIdParamSchema }), retryTransfer);
