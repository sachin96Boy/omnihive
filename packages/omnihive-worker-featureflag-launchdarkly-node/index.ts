import { HiveWorkerType } from '@withonevision/omnihive-hive-common/enums/HiveWorkerType';
import { OmniHiveLogLevel } from '@withonevision/omnihive-hive-common/enums/OmniHiveLogLevel';
import { AwaitHelper } from '@withonevision/omnihive-hive-common/helpers/AwaitHelper';
import { HiveWorker } from '@withonevision/omnihive-hive-common/models/HiveWorker';
import { HiveWorkerFactory } from '@withonevision/omnihive-hive-worker/HiveWorkerFactory';
import { IFeatureFlagWorker } from '@withonevision/omnihive-hive-worker/interfaces/IFeatureFlagWorker';
import { ILogWorker } from '@withonevision/omnihive-hive-worker/interfaces/ILogWorker';
import { HiveWorkerBase } from '@withonevision/omnihive-hive-worker/models/HiveWorkerBase';
import LaunchDarkly, { LDUser } from 'launchdarkly-node-server-sdk';
import { serializeError } from 'serialize-error';

type FeatureFlagClient = {
    clientSideId: string;
    instance: LaunchDarkly.LDClient;
    mobileKey: string;
    project: string;
    ready: boolean;
    sdkKey: string;
}

type FeatureFlag = {
    name: string;
    value: any;
}

export class LaunchDarklyNodeFeatureFlagWorkerMetadata {
    public clientSideId: string = "";
    public mobileKey: string = "";
    public project: string = "";
    public sdkKey: string = "";
    public user: string = "";
}

export default class LaunchDarklyNodeFeatureFlagWorker extends HiveWorkerBase implements IFeatureFlagWorker {

    private client!: FeatureFlagClient;
    private flags: FeatureFlag[] = [];
    private user!: LDUser;
    private project!: string;
    private logWorker: ILogWorker | undefined = undefined;

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {
        try {
            await AwaitHelper.execute<void>(super.init(config));
            const metadata: LaunchDarklyNodeFeatureFlagWorkerMetadata = this.hiveWorkerHelper.checkMetadata<LaunchDarklyNodeFeatureFlagWorkerMetadata>(LaunchDarklyNodeFeatureFlagWorkerMetadata, config.metadata);

            const ldInstance: LaunchDarkly.LDClient = LaunchDarkly.init(metadata.sdkKey);

            const flagClient: FeatureFlagClient = { clientSideId: metadata.clientSideId, mobileKey: metadata.mobileKey, project: metadata.project, sdkKey: metadata.sdkKey, instance: ldInstance, ready: false };
            this.user = { "key": metadata.user };
            this.project = metadata.project;

            flagClient.instance.on("ready", () => {
                flagClient.ready = true;
                this.client = flagClient;
            });
        } catch (err) {
            throw new Error("Launch Darkly Init Error => " + JSON.stringify(serializeError(err)));
        }
    }

    public async afterInit(): Promise<void> {
        this.logWorker = await AwaitHelper.execute<ILogWorker | undefined>(HiveWorkerFactory.getInstance().getHiveWorker<ILogWorker | undefined>(HiveWorkerType.Log));

        if (!this.logWorker) {
            throw new Error("Log Worker Not Defined.  Cross-Storage Will Not Function Without Log Worker.");
        }
    }


    public get = async <T extends unknown>(name: string, defaultValue?: boolean | undefined): Promise<T | undefined> => {

        if (!name || name.length <= 0) {
            throw new Error("No flag name given.");
        }

        if (!defaultValue) {
            defaultValue = false;
        }

        const flag: FeatureFlag[] = this.flags.filter((ff: FeatureFlag) => ff.name === name);

        if (flag.length > 0) {
            this.logWorker?.write(OmniHiveLogLevel.Info, `Flag Evaluated => Project: ${this.project} => Flag: ${name} => Value: ${flag[0].value as string}`);
            return flag[0].value as T;
        }

        let value: any;
        
        try {
            value = await AwaitHelper.execute<any>(this.client.instance.variation(name, this.user, defaultValue));
        } catch (err) {
            throw new Error("Failed to retrieve Feature Flag.");
        }
        
        this.flags.push({ name, value });

        this.client?.instance?.on(`update:${name}`, () => {

            this.client?.instance?.variation(name, this.user, defaultValue)
                .then((newValue) => {
                    this.logWorker?.write(OmniHiveLogLevel.Info, `Flag Changed => Project: ${this.project} => Flag: ${name} => New Value: ${newValue as string}`);

                    const changeFlag: FeatureFlag[] = this.flags.filter((ff: FeatureFlag) => ff.name === name);

                    if (changeFlag.length === 0) {
                        this.flags.push({ name, value: newValue });
                    } else {
                        this.flags.filter((ff: FeatureFlag) => ff.name === name)[0].value = newValue;
                    }
                });
        });

        this.logWorker?.write(OmniHiveLogLevel.Info, `Flag Evaluated and Listening => Project: ${this.project} => Flag: ${name} => Value: ${value as string}`);

        return value as T;
    }
}