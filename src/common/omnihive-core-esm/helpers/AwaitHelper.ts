export class AwaitHelper {
    public static execute = async <T>(promise: Promise<T>): Promise<T> => {
        return promise
            .then<T>((data: T) => data)
            .catch((error: any) => {
                throw error;
            });
    };
}
