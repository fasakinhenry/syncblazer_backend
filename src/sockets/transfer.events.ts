import { Transfer } from "@/models/Transfer.model.ts";
import { TransferStatus } from "@/constants/index.ts";
import type { AuthedSocket } from "@/sockets/socket.server.ts";

/**
 * Real-time progress relay for an in-flight transfer. The REST API remains
 * the source of truth for transfer records; this just pushes live progress
 * to both the sender and receiver UI without polling.
 */
export function registerTransferHandlers(socket: AuthedSocket) {
  const { userId } = socket.data;

  socket.on(
    "transfer:progress",
    async (payload: { transferId: string; progress: number; status?: (typeof TransferStatus)[keyof typeof TransferStatus] }) => {
      const transfer = await Transfer.findOne({ _id: payload.transferId, ownerId: userId });
      if (!transfer) return;

      transfer.progress = Math.max(0, Math.min(100, payload.progress));
      if (payload.status) transfer.status = payload.status;
      if (payload.status === TransferStatus.TRANSFERRING && !transfer.startedAt) {
        transfer.startedAt = new Date();
      }
      if (payload.status === TransferStatus.COMPLETED) {
        transfer.completedAt = new Date();
        transfer.progress = 100;
      }
      await transfer.save();

      socket.to(`room:${transfer.roomId.toString()}`).emit("transfer:update", {
        transferId: transfer._id,
        status: transfer.status,
        progress: transfer.progress,
      });
    }
  );
}
