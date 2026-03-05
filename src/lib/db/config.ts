/** Database configuration — reads DATABASE_URL to determine the driver */

export const DATABASE_URL = process.env.DATABASE_URL || "";
export const isPostgres = DATABASE_URL.startsWith("postgres");
