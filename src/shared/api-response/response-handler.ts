import { Response } from "express";
import { StatusCodes } from "./http-status-code";
import { ReasonPhrases } from "./reason-phrase";

export const success = (
  res: Response,
  data: any,
  msg: string,
  statusCode: number = StatusCodes.OK,
) => {
  const reasonPhrase = getReasonPhrase(statusCode);
  const response = {
    result: data,
    status: reasonPhrase,
    statusCode,
    msg,
  };
  res.status(response.statusCode).send(response);
};

export const sendError = (
  res: Response,
  msg: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
) => {
  const reasonPhrase = getReasonPhrase(statusCode);
  const response = {
    result: null,
    status: reasonPhrase,
    statusCode,
    msg,
  };
  res.status(response.statusCode).send(response);
};

const getReasonPhrase = (statusCode: number): string => {
  const statusMap: Record<number, string> = {
    [StatusCodes.OK]: ReasonPhrases.OK,
    [StatusCodes.CREATED]: ReasonPhrases.CREATED,
    [StatusCodes.ACCEPTED]: ReasonPhrases.ACCEPTED,
    [StatusCodes.BAD_REQUEST]: ReasonPhrases.BAD_REQUEST,
    [StatusCodes.UNAUTHORIZED]: ReasonPhrases.UNAUTHORIZED,
    [StatusCodes.FORBIDDEN]: ReasonPhrases.FORBIDDEN,
    [StatusCodes.NOT_FOUND]: ReasonPhrases.NOT_FOUND,
    [StatusCodes.METHOD_NOT_ALLOWED]: ReasonPhrases.METHOD_NOT_ALLOWED,
    [StatusCodes.INTERNAL_SERVER_ERROR]: ReasonPhrases.INTERNAL_SERVER_ERROR,
    [StatusCodes.NOT_IMPLEMENTED]: ReasonPhrases.NOT_IMPLEMENTED,
    [StatusCodes.BAD_GATEWAY]: ReasonPhrases.BAD_GATEWAY,
    [StatusCodes.SERVICE_UNAVAILABLE]: ReasonPhrases.SERVICE_UNAVAILABLE,
    [StatusCodes.GATEWAY_TIMEOUT]: ReasonPhrases.GATEWAY_TIMEOUT,
  };
  return statusMap[statusCode] || ReasonPhrases.OK;
};
