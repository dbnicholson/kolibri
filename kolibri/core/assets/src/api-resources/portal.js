import { Resource } from 'kolibri.lib.apiResource';
import urls from 'kolibri.urls';

export default new Resource({
  name: 'portal',
  validateToken(token) {
    const url = urls['kolibri:core:portal-validate-token']();
    return this.client({
      url,
      method: 'GET',
      params: { token },
    });
  },
  registerFacility({ facility_id, token }) {
    const url = urls['kolibri:core:portal-register']();
    return this.client({
      url,
      method: 'POST',
      data: { facility_id, token },
    });
  },
});
