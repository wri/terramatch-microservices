import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { FactoryGirl, SequelizeAdapter } from 'factory-girl-ts';
import bcrypt from 'bcryptjs';
import { User } from '@terramatch-microservices/database/entities';
import { UserFactory } from '@terramatch-microservices/database/factories';
import { Sequelize } from 'sequelize-typescript';
import * as Entities from '@terramatch-microservices/database/entities';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: DeepMocked<JwtService>;

  const sequelize = new Sequelize({
    dialect: 'mariadb',
    host: 'localhost',
    port: 3360,
    username: 'wri',
    password: 'wri',
    database: 'terramatch_microservices_test',
    models: Object.values(Entities),
    logging: false,
  });

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    FactoryGirl.setAdapter(new SequelizeAdapter());
  })

  afterAll(async () => {
    await sequelize.close();
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
