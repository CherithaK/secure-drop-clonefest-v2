import { describe, expect, it } from "vitest";
import { createTiDbCloudPool } from "./db";

describe("TiDB Cloud connection setup", () => {
  it("creates a certificate-verified pool from a TiDB Cloud connection URL", () => {
    const pool = createTiDbCloudPool(
      "mysql://securedrop_user:encoded%40password@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/securedrop?ssl=ignored"
    );

    expect(pool.pool.config.connectionConfig.host).toBe("gateway01.ap-southeast-1.prod.aws.tidbcloud.com");
    expect(pool.pool.config.connectionConfig.port).toBe(4000);
    expect(pool.pool.config.connectionConfig.database).toBe("securedrop");
    expect(pool.pool.config.connectionConfig.ssl).toMatchObject({ rejectUnauthorized: true });

    pool.end();
  });
});
