import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import type {
  KycStatusResponse,
  KycSubmission,
  KycUploadResponse,
} from "@features/kyc/types/kyc.types";

export const KycAPI = {
  status: () => unwrap<KycStatusResponse>(api.get("/user/kyc/status")),
  submit: (body: KycSubmission) =>
    unwrap<KycStatusResponse>(api.post("/user/kyc/submit", body)),
  // Upload via multipart — `file` should be a {uri, name, type} object that
  // axios FormData can serialize on RN.
  upload: (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    // RN's FormData accepts the {uri,name,type} shape directly when typed as
    // any — TS sees it as Blob | string, but the bridge marshals it correctly.
    form.append("file", file as unknown as Blob);
    return unwrap<KycUploadResponse>(
      api.post("/user/kyc/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  },
};
