FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/provisioner ./

# We need `git` on the runtime image to clone/push, so use alpine instead of distroless.
FROM alpine:3.20
RUN apk add --no-cache git ca-certificates openssh-client
COPY --from=build /out/provisioner /provisioner
RUN adduser -D -u 10001 provisioner && mkdir -p /var/lib/provisioner/repo && chown -R provisioner /var/lib/provisioner
USER provisioner
EXPOSE 8091
ENTRYPOINT ["/provisioner"]
