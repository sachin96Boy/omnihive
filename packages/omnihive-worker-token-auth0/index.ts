import { AwaitHelper } from '@withonevision/omnihive-hive-common/helpers/AwaitHelper';
import { StringHelper } from '@withonevision/omnihive-hive-common/helpers/StringHelper';
import { HiveWorker } from '@withonevision/omnihive-hive-common/models/HiveWorker';
import { ITokenWorker } from '@withonevision/omnihive-hive-worker/interfaces/ITokenWorker';
import { HiveWorkerBase } from '@withonevision/omnihive-hive-worker/models/HiveWorkerBase';
import { AuthenticationClient, ClientCredentialsGrantOptions } from 'auth0';
import axios, { AxiosResponse } from 'axios';
import jwtDecode from 'jwt-decode';
import jose from 'node-jose';
import { serializeError } from 'serialize-error';


export class AuthZeroTokenWorkerMetadata {
    public clientId: string = "";
    public clientSecret: string = "";
    public domain: string = "";
    public audience: string = "";
    public verifyOn: boolean = true;
}

export default class AuthZeroTokenWorker extends HiveWorkerBase implements ITokenWorker {

    private metadata!: AuthZeroTokenWorkerMetadata
    private token: string = "";
    private authClient!: AuthenticationClient

    constructor() {
        super();
    }

    public async init(config: HiveWorker): Promise<void> {

        await AwaitHelper.execute<void>(super.init(config));
        this.metadata = this.checkMetadata<AuthZeroTokenWorkerMetadata>(AuthZeroTokenWorkerMetadata, config.metadata);
        this.authClient = new AuthenticationClient({
            domain: this.metadata.domain,
            clientId: this.metadata.clientId,
            clientSecret: this.metadata.clientSecret,
        });
    }

    public get = async (_payload?: object): Promise<string> => {
        try {
            if (this.token !== "" && !this.expired(this.token)) {
                return this.token;
            }

            const options: ClientCredentialsGrantOptions = {
                audience: this.metadata.audience,
            };

            this.token = (await this.authClient.clientCredentialsGrant(options)).access_token;
            this.token = `${this.metadata.clientId}||${this.token}`;
            return this.token;
        } catch (err) {
            throw new Error(`Get Token Error => ${JSON.stringify(serializeError(err))}`);
        }
    }

    public expired = async (token: string): Promise<boolean> => {

        const clientId = token.split("||")[0];
        token = token.split("||")[1];

        try {
            const currentTimestamp = Math.floor(Date.now().valueOf() / 1000);
            const decoded: any = jwtDecode(token);

            if (decoded.azp !== clientId || decoded.exp === 'undefined' || currentTimestamp > decoded.exp) {
                throw new Error("Access token is either the wrong client or expired");
            }

            return true;
        } catch {
            throw new Error("Access token is either the wrong client or expired");
        }
    }

    public verify = async (token: string): Promise<boolean> => {

        if (this.metadata.verifyOn === false) {
            return true;
        }

        if (StringHelper.isNullOrWhiteSpace(token)) {
            throw new Error("No access token was given");
        }

        const clientId = token.split("||")[0];
        token = token.split("||")[1];

        const sections: string[] = token.split(".");

        // get the kid from the headers prior to verification
        const header: string = jose.util.base64url.decode(sections[0]).toString();
        const parsedHeader: any = JSON.parse(header);
        const kid: string = parsedHeader.kid;

        // download the public keys
        let jwks: AxiosResponse<any>;

        try {
            jwks = await AwaitHelper.execute<AxiosResponse<any>>(axios.get(`https://${this.metadata.domain}/.well-known/jwks.json`));
        } catch (e) {
            throw new Error("JWKS Url Not Responding");
        }

        if (jwks.status !== 200) {
            throw new Error("Unknown validation error");
        }

        const keys: any = jwks.data.keys;

        // search for the kid in the downloaded public keys
        let keyIndex: number = -1;

        for (let i: number = 0; i < keys.length; i++) {
            if (kid === keys[i].kid) {
                keyIndex = i;
                break;
            }
        }

        if (keyIndex === -1) {
            throw new Error("No JWKS public key");
        }

        // construct the public key
        let jwkKey: jose.JWK.Key;

        try {
            jwkKey = await AwaitHelper.execute<jose.JWK.Key>(jose.JWK.asKey(keys[keyIndex]));
        } catch (e) {
            throw new Error("Invalid key");
        }

        // verify the signature
        let jwkVerification: jose.JWS.VerificationResult;

        try {
            jwkVerification = await AwaitHelper.execute<jose.JWS.VerificationResult>(jose.JWS.createVerify(jwkKey).verify(token));
        } catch (e) {
            throw new Error("Signature verification failed");
        }

        // now we can use the claims
        const claims = JSON.parse(jwkVerification.payload.toString());

        // additionally we can verify the token expiration
        const currentTimestamp = Math.floor((new Date()).valueOf() / 1000);

        if (currentTimestamp > claims.exp) {
            throw new Error("Token expired");
        }

        // and the client ID the token was issued to
        if (claims.azp !== clientId) {
            throw new Error("No audience granted");
        }

        return true;
    }
}