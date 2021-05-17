import { AwaitHelper } from "@withonevision/omnihive-core/helpers/AwaitHelper";
import { IConfigWorker } from "@withonevision/omnihive-core/interfaces/IConfigWorker";
import { HiveWorker } from "@withonevision/omnihive-core/models/HiveWorker";
import { HiveWorkerBase } from "@withonevision/omnihive-core/models/HiveWorkerBase";
import { ServerSettings } from "@withonevision/omnihive-core/models/ServerSettings";
import fse from "fs-extra";
import { serializeError } from "serialize-error";
import { StringHelper } from "@withonevision/omnihive-core/helpers/StringHelper";
import { HiveWorkerMetadataDatabase } from "@withonevision/omnihive-core/models/HiveWorkerMetadataDatabase";
import knex, { Knex } from "knex";
import pg from "pg";

export class PostgresConfigWorkerMetadata extends HiveWorkerMetadataDatabase {
    public configName: string = "";
}

export default class PostgresConfigWorker extends HiveWorkerBase implements IConfigWorker {
    public connection!: Knex;
    private connectionPool!: pg.Pool;
    private sqlConfig!: any;
    private metadata!: PostgresConfigWorkerMetadata;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        try {
            await AwaitHelper.execute(super.init(config));
            this.metadata = this.checkObjectStructure<PostgresConfigWorkerMetadata>(
                PostgresConfigWorkerMetadata,
                config.metadata
            );

            if (StringHelper.isNullOrWhiteSpace(this.metadata.configName)) {
                throw new Error("No config name set to retrieve");
            }

            this.sqlConfig = {
                host: this.metadata.serverAddress,
                port: this.metadata.serverPort,
                database: this.metadata.databaseName,
                user: this.metadata.userName,
                password: this.metadata.password,
            };

            if (this.metadata.requireSsl) {
                if (StringHelper.isNullOrWhiteSpace(this.metadata.sslCertPath)) {
                    this.sqlConfig.ssl = this.metadata.requireSsl;
                } else {
                    this.sqlConfig.ssl = {
                        ca: fse.readFileSync(this.metadata.sslCertPath).toString(),
                    };
                }
            }

            this.connectionPool = new pg.Pool({ ...this.sqlConfig });
            this.connectionPool.connect();

            const connectionOptions: Knex.Config = {
                connection: {},
                pool: { min: 0, max: this.metadata.connectionPoolLimit },
            };
            connectionOptions.client = "pg";
            connectionOptions.connection = this.sqlConfig;
            this.connection = knex(connectionOptions);
        } catch (err) {
            throw new Error("Postgres Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public get = async (): Promise<ServerSettings> => {
        const srvConfigBaseSql = `
            SELECT   config_id
                    ,cluster_id
                    ,config_name
            FROM srv_config_base 
            WHERE config_name = '${this.metadata.configName}'`;

        const srvConfigConstantsSql = `
            SELECT   c.constant_id
                    ,c.config_id
                    ,c.constant_key
                    ,c.constant_value
            FROM srv_config_constants c
                INNER JOIN srv_config_base b
                    on c.config_id = b.config_id
            WHERE b.config_name = '${this.metadata.configName}'`;

        const srvConfigFeaturesSql = `
            SELECT   f.feature_id
                    ,f.config_id
                    ,f.feature_key
                    ,f.feature_value
            FROM srv_config_features f
                INNER JOIN srv_config_base b
                    on f.config_id = b.config_id
            WHERE b.config_name = '${this.metadata.configName}'`;

        const srvConfigWorkersSql = `
            SELECT   w.worker_id
                    ,w.config_id
                    ,w.name
                    ,w.type
                    ,w.package
                    ,w.version
                    ,w.import_path
                    ,w.default
                    ,w.enabled
                    ,w.metadata
            FROM srv_config_workers w
                INNER JOIN srv_config_base b
                    on w.config_id = b.config_id
            WHERE b.config_name = '${this.metadata.configName}'`;

        const results = await AwaitHelper.execute(
            Promise.all([
                this.executeQuery(srvConfigBaseSql),
                this.executeQuery(srvConfigConstantsSql),
                this.executeQuery(srvConfigFeaturesSql),
                this.executeQuery(srvConfigWorkersSql),
            ])
        );

        const serverSettings: ServerSettings = new ServerSettings();

        results[1][0].forEach((row) => {
            serverSettings.constants[row.constant_key] = row.constant_value;
        });

        results[2][0].forEach((row) => {
            serverSettings.features[row.feature_key] = row.feature_value;
        });

        results[3][0].forEach((row) => {
            serverSettings.workers.push({
                name: row.name,
                type: row.type,
                package: row.package,
                version: row.version,
                importPath: row.import_path,
                default: row.default,
                enabled: row.enabled,
                metadata: row.metadata,
            });
        });

        return serverSettings;
    };

    public set = async (_settings: ServerSettings): Promise<boolean> => {
        return true;
    };

    private executeQuery = async (query: string): Promise<any[][]> => {
        const result = await AwaitHelper.execute(this.connectionPool.query(query));

        const returnResults: any[][] = [];
        let currentResultIndex: number = 0;

        if (!Array.isArray(result)) {
            returnResults[currentResultIndex] = result.rows;
            return returnResults;
        }

        for (let r of result) {
            returnResults[currentResultIndex] = r.rows;
            currentResultIndex++;
        }

        return returnResults;
    };
}
