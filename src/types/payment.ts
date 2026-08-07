export interface Payment {
  id:                   string;
  appointmentId:        string;
  clientId:             string;
  doctorId:             string;
  amount:               number;
  currency:             "USD" | "XCD" | "TTD";
  gateway:              "stripe" | "WiPay" | "manual";
  gatewayTransactionId?: string;
  status:               "initiated" | "pending" | "completed" | "success" | "failed" | "refunded";
  receiptURL?:          string;
  createdAt:            Date;
  updatedAt:            Date;
}
