import { Router } from "express";
import {
  createInstantRoom,
  createRoom,
  deleteRoom,
  getRoom,
  inviteToRoom,
  joinRoom,
  listRooms,
  removeMember,
  updateRoom,
} from "@/controllers/room.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  createRoomSchema,
  inviteToRoomSchema,
  joinRoomSchema,
  roomIdParamSchema,
  roomMemberParamSchema,
  updateRoomSchema,
} from "@/validators/room.validators.ts";

export const roomRouter = Router();

roomRouter.use(requireAuth);

roomRouter.get("/", listRooms);
roomRouter.post("/", validate({ body: createRoomSchema }), createRoom);
roomRouter.post("/instant", createInstantRoom);
roomRouter.post("/join", validate({ body: joinRoomSchema }), joinRoom);
roomRouter.get("/:roomId", validate({ params: roomIdParamSchema }), getRoom);
roomRouter.patch("/:roomId", validate({ params: roomIdParamSchema, body: updateRoomSchema }), updateRoom);
roomRouter.delete("/:roomId", validate({ params: roomIdParamSchema }), deleteRoom);
roomRouter.post("/:roomId/invite", validate({ params: roomIdParamSchema, body: inviteToRoomSchema }), inviteToRoom);
roomRouter.delete("/:roomId/members/:userId", validate({ params: roomMemberParamSchema }), removeMember);
