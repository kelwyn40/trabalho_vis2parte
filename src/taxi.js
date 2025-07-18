import { loadDb } from "./config.js";

export class Taxi {
    async init() {
        this.db = await loadDb();
        this.conn = await this.db.connect();
        this.color = "green";
        this.table = "taxi_2023";
    }

    async loadTaxi(months = 6) {
        if (!this.db || !this.conn) throw new Error("Database not initialized. Please call init() first.");
        const files = [];
        for (let id = 1; id <= months; id++) {
            const sId = String(id).padStart(2, "0");
            const url = `parquet/${this.color}_tripdata_2023-${sId}.parquet`;
            files.push({ key: `Y2023M${sId}`, url });
            const res = await fetch(url);
            await this.db.registerFileBuffer(files[files.length - 1].key, new Uint8Array(await res.arrayBuffer()));
        }
        await this.conn.query(`
            CREATE OR REPLACE TABLE ${this.table} AS
            SELECT * FROM read_parquet([${files.map((d) => `'${d.key}'`).join(",")}]);
        `);
    }

    async query(sql) {
        if (!this.db || !this.conn) throw new Error("Database not initialized. Please call init() first.");
        const result = await this.conn.query(sql);
        return result.toArray().map((row) => row.toJSON());
    }
}
