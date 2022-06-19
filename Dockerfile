FROM node:16 AS build

COPY . /usr/app

WORKDIR /usr/app

RUN NODE_ENV=development yarn install --frozen-lockfile && \
    yarn build && \
    yarn install --frozen-lockfile

FROM public.ecr.aws/lambda/nodejs:16

ENV NODE_ENV=production

COPY --from=build /usr/app ${LAMBDA_TASK_ROOT}
