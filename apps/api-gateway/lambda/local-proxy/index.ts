import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from 'aws-lambda'

export async function main(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const query = event.rawQueryString === '' ? '' : `?${event.rawQueryString}`;
  const url = `${process.env.PROXY_TARGET}${event.rawPath}${query}`;
  const requestHeaders = new Headers();
  for (const header in event.headers) {
    requestHeaders.append(header, event.headers[header]!);
  }

  const requestInit = {
    method: event.requestContext.http.method,
    headers: requestHeaders,
  } as RequestInit;
  if (['POST', 'PATCH', 'PUT'].includes(event.requestContext.http.method)) {
    requestInit['body'] = event.body;
  }

  const result = await fetch(url, requestInit);

  return {
    body: await result.text(),
    statusCode: result.status,
    isBase64Encoded: false,
    headers: {
      'Cache-Control': result.headers.get('Cache-Control') ?? 'no-cache',
      'Content-Type': result.headers.get('Content-Type') ?? 'application/json',
    },
    cookies: result.headers.getSetCookie()
  }
}
