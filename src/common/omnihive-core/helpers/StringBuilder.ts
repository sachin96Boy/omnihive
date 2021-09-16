export class StringBuilder {
    public values: string[] = [];

    public constructor(value: string = "") {
        this.values = new Array(value);
    }

    public outputString() {
        return this.values.join("");
    }

    public append(value: string = "") {
        this.values.push(value);
    }

    public appendLine(value: string = "") {
        this.values.push(value + "\r\n");
    }

    public clear() {
        this.values = [];
    }
}
