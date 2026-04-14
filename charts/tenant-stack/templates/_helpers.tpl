{{- define "tenant.fullname" -}}
{{- printf "tenant-%s" .Values.tenant.id | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "tenant.labels" -}}
app.kubernetes.io/managed-by: saasobserve
app.kubernetes.io/part-of: tenant-stack
saasobserve.io/tenant: {{ .Values.tenant.id | quote }}
{{- end -}}

{{- define "tenant.resources" -}}
{{- $override := index .Values.resources .component -}}
{{- if $override -}}
{{ $override | toYaml }}
{{- else -}}
{{ .Values.resources.default | toYaml }}
{{- end -}}
{{- end -}}

{{- define "tenant.storage" -}}
{{- if eq .storageClass "" -}}
emptyDir: {}
{{- else -}}
persistentVolumeClaim:
  claimName: {{ .claimName }}
{{- end -}}
{{- end -}}
