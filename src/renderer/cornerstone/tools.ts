import {
  addTool,
  ZoomTool,
  PanTool,
  PlanarRotateTool,
  WindowLevelTool,
  StackScrollTool,
  ToolGroupManager,
  Enums,
} from '@cornerstonejs/tools'

const { MouseBindings } = Enums

export const TOOL_GROUP_ID = 'dicom-tool-group'

export function initTools(): void {
  addTool(ZoomTool)
  addTool(PanTool)
  addTool(PlanarRotateTool)
  addTool(WindowLevelTool)
  addTool(StackScrollTool)
}

export function setupToolGroup(viewportId: string, renderingEngineId: string): void {
  const existing = ToolGroupManager.getToolGroup(TOOL_GROUP_ID)
  if (existing) ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID)

  const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!

  toolGroup.addTool(WindowLevelTool.toolName)
  toolGroup.addTool(PanTool.toolName)
  toolGroup.addTool(ZoomTool.toolName)
  toolGroup.addTool(PlanarRotateTool.toolName)
  toolGroup.addTool(StackScrollTool.toolName)

  toolGroup.addViewport(viewportId, renderingEngineId)

  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  })
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Auxiliary }],
  })
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Secondary }],
  })
  // Mouse wheel scrolls through stack frames
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Wheel }],
  })
}

export function setActivePrimaryTool(toolName: string): void {
  const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID)
  if (!toolGroup) return

  const primaryTools = [
    WindowLevelTool.toolName,
    PanTool.toolName,
    ZoomTool.toolName,
    PlanarRotateTool.toolName,
  ]

  primaryTools.forEach((t) => {
    if (t === toolName) {
      toolGroup.setToolActive(t, { bindings: [{ mouseButton: MouseBindings.Primary }] })
    } else {
      toolGroup.setToolPassive(t)
    }
  })

  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Wheel }],
  })
}
