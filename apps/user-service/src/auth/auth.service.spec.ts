import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { User } from '@terramatch-microservices/database';
import { FactoryGirl, TypeOrmRepositoryAdapter } from 'factory-girl-ts';
import { DataSource } from 'typeorm';
import { UserFactory } from '@terramatch-microservices/database';
import bcrypt from 'bcryptjs';

const dataSource = new DataSource({
  type: 'mariadb',
  host: 'localhost',
  port: 3360,
  username: 'wri',
  password: 'wri',
  // TODO: script to create DB. Going to need a docker container on github actions
  database: 'terramatch_microservices_test',
  timezone: 'Z',
  entities: [User],
  synchronize: true,
});

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: DeepMocked<JwtService>;

  beforeAll(async () => {
    FactoryGirl.setAdapter(new TypeOrmRepositoryAdapter(dataSource));

    await dataSource.initialize();
    await dataSource.getRepository(User).delete({});
  })

  afterAll(async () => {
    await dataSource.driver.disconnect();
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService = createMock<JwtService>() }
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should return null with invalid email', async () => {
    jest.spyOn(User, 'findOne').mockImplementation(() => Promise.resolve(null));
    expect(await service.login('fake@foo.bar', 'asdfasdfsadf')).toBeNull()
  })

  it('should return null with an invalid password', async () => {
    const { emailAddress } = await UserFactory.create({ password: 'fakepasswordhash' });
    expect(await service.login(emailAddress, 'fakepassword')).toBeNull();
  })

  it('should return a token and id with a valid password', async () => {
    const { id, emailAddress } = await UserFactory.create({ password: 'fakepasswordhash' });
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    const token = 'fake jwt token';
    jwtService.signAsync.mockReturnValue(Promise.resolve(token));

    const result = await service.login(emailAddress, 'fakepassword');

    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(result.token).toBe(token);
    expect(result.userId).toBe(id);
  });

  it('should update the last logged in date on the user', async () => {
    const user = await UserFactory.create({ password: 'fakepasswordhash' });
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
    jwtService.signAsync.mockResolvedValue('fake jwt token');

    await service.login(user.emailAddress, 'fakepassword');

    const { lastLoggedInAt } = user;
    await user.reload();
    expect(lastLoggedInAt).not.toBe(user.lastLoggedInAt);
  })
});
