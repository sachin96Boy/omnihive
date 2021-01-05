import { HiveAccountType } from "./HiveAccountType";
import { Customer } from "./Customer";

export class HiveAccount {
    public id: number = 0;
    public name: string = "";
    public customerId: number = 0;
    public private: boolean = false;
    public statusId: number = 0;
    public customer: Customer = new Customer();
    public type: HiveAccountType = new HiveAccountType();
}