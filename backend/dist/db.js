"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Reuse a single Prisma client to avoid connection overhead
exports.prisma = globalThis.__prisma || new client_1.PrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = exports.prisma;
}
//# sourceMappingURL=db.js.map