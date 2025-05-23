import { Context, Res, BodyParams, QueryParams } from "@tsed/common";
import { Controller } from "@tsed/di";
import { UseBefore } from "@tsed/platform-middlewares";
import { ContentType, Delete, Description, Patch, Post, Put } from "@tsed/schema";
import { Cookie } from "@snailycad/config";
import { prisma } from "lib/data/prisma";
import { IsAuth } from "middlewares/auth/is-auth";
import { setCookie } from "utils/set-cookie";
import { cad, Rank, ShouldDoType, StatusViewMode, TableActionsAlignment } from "@prisma/client";
import { NotFound } from "@tsed/exceptions";
import {
  CHANGE_PASSWORD_SCHEMA,
  CHANGE_USER_SCHEMA,
  DASHBOARD_LAYOUT_SCHEMA,
} from "@snailycad/schemas";
import { compareSync, genSaltSync, hashSync } from "bcrypt";
import { userProperties } from "lib/auth/getSessionUser";
import { validateSchema } from "lib/data/validate-schema";
import { ExtendedBadRequest } from "~/exceptions/extended-bad-request";
import { Socket } from "services/socket-service";
import { handleStartEndOfficerLog } from "lib/leo/handleStartEndOfficerLog";
import { setUserPreferencesCookies } from "lib/auth/setUserPreferencesCookies";
import * as APITypes from "@snailycad/types/api";
import { User } from "@snailycad/types";
import { getActiveOfficer } from "~/lib/leo/activeOfficer";
import { getActiveDeputy } from "~/lib/get-active-ems-fd-deputy";

@Controller("/user")
@UseBefore(IsAuth)
@ContentType("application/json")
export class UserController {
  private socket: Socket;
  constructor(socket: Socket) {
    this.socket = socket;
  }

  @Post("/")
  @Description("Get the authenticated user's information")
  async getAuthUser(
    @Context("cad") cad: cad,
    @Context("user") user: User,
    @Context() ctx: Context,
    @QueryParams("includeActiveUnit", Boolean) includeActiveUnit?: boolean,
  ): Promise<APITypes.GetUserData> {
    const cadWithoutDiscordRoles = { ...cad, discordRoles: undefined };

    if (includeActiveUnit) {
      const [officer, deputy] = await Promise.all([
        getActiveOfficer({ user, ctx }).catch(() => null),
        getActiveDeputy({ user, ctx }).catch(() => null),
      ]);

      const unit = (officer ?? deputy ?? null) as
        | APITypes.GetActiveOfficerData
        | APITypes.GetEmsFdActiveDeputy
        | null;

      return { ...user, unit, cad: cadWithoutDiscordRoles };
    }

    return { ...user, cad: cadWithoutDiscordRoles };
  }

  @Patch("/")
  @Description("Update the authenticated user's settings")
  async patchAuthUser(
    @Res() res: Res,
    @BodyParams() body: any,
    @Context("user") user: User,
  ): Promise<APITypes.PatchUserData> {
    const data = validateSchema(CHANGE_USER_SCHEMA, body);

    const existing = await prisma.user.findUnique({
      where: { username: data.username },
      select: { username: true },
    });

    if (existing && user.username !== data.username) {
      throw new ExtendedBadRequest({ username: "userAlreadyExists" });
    }

    if (!user.discordId && !/^([a-z_.\d]+)*[a-z\d]+$/i.test(data.username)) {
      throw new ExtendedBadRequest({ username: "invalidUsername" });
    }

    let soundSettingsId = null;
    if (data.soundSettings) {
      const updateCreateData = {
        panicButton: data.soundSettings.panicButton,
        signal100: data.soundSettings.signal100,
        addedToCall: data.soundSettings.addedToCall,
        stopRoleplay: data.soundSettings.stopRoleplay,
        statusUpdate: data.soundSettings.statusUpdate,
        incomingCall: data.soundSettings.incomingCall,
        speech: data.soundSettings.speech,
        speechVoice: data.soundSettings.speechVoice,
      };

      const updated = await prisma.userSoundSettings.upsert({
        where: { id: String(user.soundSettingsId) },
        create: updateCreateData,
        update: updateCreateData,
      });

      soundSettingsId = updated.id;
    }

    const updated = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        username: data.username,
        isDarkTheme: data.isDarkTheme,
        statusViewMode: data.statusViewMode as StatusViewMode,
        tableActionsAlignment: data.tableActionsAlignment as TableActionsAlignment,
        soundSettingsId,
        locale: data.locale || null,
        developerMode: data.developerMode ?? false,
      },
      select: userProperties,
    });

    setUserPreferencesCookies({
      isDarkTheme: data.isDarkTheme,
      locale: data.locale ?? null,
      res,
    });

    return updated;
  }

  @Delete("/")
  @Description("Delete the authenticated user's account")
  async deleteAuthUser(@Context("user") user: User) {
    if (user.rank === Rank.OWNER) {
      throw new ExtendedBadRequest({ rank: "cannotDeleteOwner" });
    }

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
  }

  @Post("/logout")
  @Description("Logout the authenticated user")
  async logoutUser(@Res() res: Res, @Context() ctx: Context): Promise<APITypes.PostUserLogoutData> {
    const userId = ctx.get("user").id;
    ctx.delete("user");

    setCookie({
      res,
      name: Cookie.AccessToken,
      expires: 0,
      value: "",
    });

    setCookie({
      res,
      name: Cookie.RefreshToken,
      expires: 0,
      value: "",
    });

    await Promise.all([
      prisma.activeDispatchers.deleteMany({ where: { userId } }),
      prisma.userSession.deleteMany({ where: { userId } }),
    ]);

    const officer = await prisma.officer.findFirst({
      where: {
        userId,
        status: {
          NOT: { shouldDo: ShouldDoType.SET_OFF_DUTY },
        },
      },
    });

    if (officer) {
      await prisma.$transaction([
        prisma.officer.update({
          where: { id: officer.id },
          data: { statusId: null, activeCallId: null },
        }),
        prisma.dispatchChat.deleteMany({
          where: { unitId: officer.id },
        }),
      ]);

      await handleStartEndOfficerLog({
        unit: officer,
        shouldDo: "SET_OFF_DUTY",
        socket: this.socket,
        userId,
        type: "leo",
      });

      await this.socket.emitUpdateOfficerStatus();
    }

    const emsFdDeputy = await prisma.emsFdDeputy.findFirst({
      where: {
        userId,
        status: { NOT: { shouldDo: ShouldDoType.SET_OFF_DUTY } },
      },
    });

    if (emsFdDeputy) {
      await handleStartEndOfficerLog({
        unit: emsFdDeputy,
        shouldDo: "SET_OFF_DUTY",
        socket: this.socket,
        userId,
        type: "ems-fd",
      });

      await prisma.$transaction([
        prisma.emsFdDeputy.update({
          where: { id: emsFdDeputy.id },
          data: { statusId: null, activeCallId: null },
        }),
        prisma.dispatchChat.deleteMany({
          where: { unitId: emsFdDeputy.id },
        }),
      ]);

      await this.socket.emitUpdateDeputyStatus();
    }

    return true;
  }

  @Post("/password")
  @Description("Update the authenticated user's password")
  async updatePassword(
    @Context("user") user: User,
    @BodyParams() body: unknown,
  ): Promise<APITypes.PostUserPasswordData> {
    const data = validateSchema(CHANGE_PASSWORD_SCHEMA, body);

    const u = await prisma.user.findUnique({ where: { id: user.id } });

    if (!u) {
      throw new NotFound("notFound");
    }

    const { currentPassword, newPassword, confirmPassword } = data;
    const usesOauthProvider = (u.discordId || u.steamId) && !u.password.trim();

    if (confirmPassword !== newPassword) {
      throw new ExtendedBadRequest({ confirmPassword: "passwordsDoNotMatch" });
    }

    /**
     * if the user is authenticated via Oauth,
     * their model is created with an empty password. Therefore the user cannot login
     * if the user wants to enable password login, they can do so by providing a new-password
     * without entering the `currentPassword`.
     */
    if (!usesOauthProvider && currentPassword) {
      const userPassword = u.tempPassword ?? u.password;
      const isCurrentPasswordCorrect = compareSync(currentPassword, userPassword);
      if (!isCurrentPasswordCorrect) {
        throw new ExtendedBadRequest({ currentPassword: "currentPasswordIncorrect" });
      }
    } else {
      if (!usesOauthProvider && !currentPassword) {
        throw new ExtendedBadRequest({ currentPassword: "Should be at least 8 characters" });
      }
    }

    const salt = genSaltSync();
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashSync(newPassword, salt),
        tempPassword: null,
      },
    });

    return true;
  }

  @Put("/dashboard-layout")
  async editDashboardLayout(@BodyParams() body: unknown, @Context("user") user: User) {
    const data = validateSchema(DASHBOARD_LAYOUT_SCHEMA, body);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        [data.type]: data.layout,
      },
      select: userProperties,
    });

    return updatedUser;
  }
}
