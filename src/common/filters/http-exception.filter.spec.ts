import { ArgumentsHost, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  const hostFor = (url: string) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  it('keeps the validation messages array from the ValidationPipe', () => {
    const { host, status, json } = hostFor('/api/auth/register');

    filter.catch(new BadRequestException(['email must be an email']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: ['email must be an email'],
      path: '/api/auth/register',
      timestamp: expect.any(String),
    });
  });

  it('uses a readable error label when the exception only has a message', () => {
    const body = filter.buildBody(new UnauthorizedException(), '/api/users');
    expect(body).toMatchObject({ statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' });
  });

  it('keeps custom messages', () => {
    const body = filter.buildBody(new NotFoundException('Ticket not found'), '/api/tickets');
    expect(body).toMatchObject({ statusCode: 404, error: 'Not Found', message: 'Ticket not found' });
  });

  it('hides the details of unknown errors behind a 500', () => {
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor('/api/movies');

    filter.catch(new Error('connection refused'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Unexpected error, check server logs',
    });
  });
});
