FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/auth-webhook ./

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/auth-webhook /auth-webhook
USER nonroot:nonroot
EXPOSE 8090
ENTRYPOINT ["/auth-webhook"]
