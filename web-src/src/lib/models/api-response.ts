
export type ApiResponse<T> = {
    msg: string;
    result: T;
    status: string;
    statusCode: number;
};

export type ApiResponseList<T> = {
  msg: string;
  result: {
    rows: T[];
    count: number;
  };
  status: string;
  statusCode: number;
};