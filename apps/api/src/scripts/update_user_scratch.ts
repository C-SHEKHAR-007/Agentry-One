import { prisma } from "../db/client.js";
import bcrypt from "bcryptjs";

async function main() {
    const email = "c.shekhar.c101@gmail.com";
    const newPassword = "test@123";
    const hash = await bcrypt.hash(newPassword, 10);

    const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });

    if (existing) {
        const updated = await prisma.user.update({
            where: { id: existing.id },
            data: {
                passwordHash: hash,
                role: "owner",
            },
        });
        console.log("Successfully updated existing user:", {
            id: updated.id,
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
            role: updated.role,
            passwordUpdated: true,
        });
    } else {
        const created = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                firstName: "Chandra",
                lastName: "Shekhar",
                passwordHash: hash,
                role: "owner",
            },
        });
        console.log(
            "User did not exist. Successfully created new owner user:",
            {
                id: created.id,
                email: created.email,
                firstName: created.firstName,
                lastName: created.lastName,
                role: created.role,
                passwordUpdated: true,
            },
        );
    }
}

main()
    .catch((e) => {
        console.error("Error updating user:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
