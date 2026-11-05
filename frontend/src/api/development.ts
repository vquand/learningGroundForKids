import {coreRequest} from './core';
import type {DevelopmentProject} from '../../../server/src/town-building/development';
export function fetchTownDevelopment(id:string):Promise<{town:DevelopmentProject;lake?:DevelopmentProject}> {
    return coreRequest<{town:DevelopmentProject;lake?:DevelopmentProject}>(`/api/v1/profiles/${encodeURIComponent(id)}/town/development`);
}
