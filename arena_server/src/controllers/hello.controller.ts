import { Get, Route, Tags } from 'tsoa';

type HelloWorldResponse = { message: string };

@Route('/api/hello')
export default class HelloController {
  /**
   * Hello world ping message
   * @summary Hello world ping message
   * @returns message
   */
  @Get('/')
  @Tags('Diagnostic')
  public async getMessage(): Promise<HelloWorldResponse> {
    return {
      message: 'Hello World. I am the SAP Labs CEE Hub Programming Competition 2023 Arena server.',
    };
  }
}
