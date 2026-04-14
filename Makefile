.PHONY: help cluster bootstrap platform tenant-manual clean loadtest images

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

cluster: ## Create kind cluster
	kind create cluster --config deploy/kind/cluster.yaml --name saasobserve || true

bootstrap: cluster ## Full local bootstrap (cluster + argocd + platform)
	./deploy/kind/bootstrap.sh

platform: ## Install the platform chart via helm
	helm upgrade --install platform charts/platform -n saasobserve-system --create-namespace

tenant-manual: ## Manually install a tenant-stack (TENANT=foo)
	@if [ -z "$(TENANT)" ]; then echo "usage: make tenant-manual TENANT=<id>"; exit 1; fi
	kubectl create ns tenant-$(TENANT) --dry-run=client -o yaml | kubectl apply -f -
	helm upgrade --install tenant charts/tenant-stack -n tenant-$(TENANT) \
	  --set tenant.id=$(TENANT) --values charts/tenant-stack/values-scale-test.yaml

images: ## Build & load local images into kind
	docker build -t saasobserve/api:dev apps/api
	docker build -t saasobserve/auth-webhook:dev apps/auth-webhook
	docker build -t saasobserve/provisioner:dev apps/provisioner
	docker build -t saasobserve/ui:dev apps/ui
	kind load docker-image saasobserve/api:dev --name saasobserve
	kind load docker-image saasobserve/auth-webhook:dev --name saasobserve
	kind load docker-image saasobserve/provisioner:dev --name saasobserve
	kind load docker-image saasobserve/ui:dev --name saasobserve

loadtest: ## Run the 100-tenant scale harness
	./tests/load/scale-100-tenants.sh

clean: ## Destroy the kind cluster
	kind delete cluster --name saasobserve
