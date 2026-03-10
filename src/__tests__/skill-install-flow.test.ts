import { describe, expect, it, vi } from 'vitest';
import { dispatchInstallFlow, ensureInstallFlowSelection } from '../cli/install-skill/flow.js';

describe('install skill flow dispatcher', () => {
  it('should dispatch to file placement handler when file placement mode is selected', async () => {
    const onSkillDeploy = vi.fn(async () => {});
    const onFilePlacement = vi.fn(async () => {});
    const onTemplateApply = vi.fn(async () => {});

    await dispatchInstallFlow({
      selection: ensureInstallFlowSelection('File placement'),
      onSkillDeploy,
      onFilePlacement,
      onTemplateApply,
    });

    expect(onFilePlacement).toHaveBeenCalledTimes(1);
    expect(onSkillDeploy).not.toHaveBeenCalled();
    expect(onTemplateApply).not.toHaveBeenCalled();
  });

  it('should dispatch to template apply handler when template apply mode is selected', async () => {
    const onSkillDeploy = vi.fn(async () => {});
    const onFilePlacement = vi.fn(async () => {});
    const onTemplateApply = vi.fn(async () => {});

    await dispatchInstallFlow({
      selection: ensureInstallFlowSelection('Template apply'),
      onSkillDeploy,
      onFilePlacement,
      onTemplateApply,
    });

    expect(onTemplateApply).toHaveBeenCalledTimes(1);
    expect(onSkillDeploy).not.toHaveBeenCalled();
    expect(onFilePlacement).not.toHaveBeenCalled();
  });

  it('should dispatch to skill deploy handler when skill deploy mode is selected', async () => {
    const onSkillDeploy = vi.fn(async () => {});
    const onFilePlacement = vi.fn(async () => {});
    const onTemplateApply = vi.fn(async () => {});

    await dispatchInstallFlow({
      selection: ensureInstallFlowSelection('Skill deploy'),
      onSkillDeploy,
      onFilePlacement,
      onTemplateApply,
    });

    expect(onSkillDeploy).toHaveBeenCalledTimes(1);
    expect(onFilePlacement).not.toHaveBeenCalled();
    expect(onTemplateApply).not.toHaveBeenCalled();
  });
});
