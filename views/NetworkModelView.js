/* globals d3 */
import GoldenLayoutView from './Common/GoldenLayoutView.js';
import LocatedViewMixin from './Common/LocatedViewMixin.js';
import SvgViewMixin from './Common/SvgViewMixin.js';

const MIN_NODE_SIZE = 2.5;
const MAX_NODE_SIZE = 70;

class NetworkModelView extends SvgViewMixin(LocatedViewMixin(GoldenLayoutView)) {
  constructor ({ container, state }) {
    super({
      container,
      icon: NetworkModelView.icon,
      label: NetworkModelView.label,
      state
    });
  }
  setup () {
    super.setup();
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id))
      .force('charge', d3.forceManyBody().strength(-MAX_NODE_SIZE))
      .force('center', d3.forceCenter())
      .force('collide', d3.forceCollide());
  }
  async getEmptyState () {
    const temp = await super.getEmptyState();
    if (temp) { return temp; }
    const networkModel = await this.location.getFlatGraphSchema();
    if (Object.keys(networkModel.nodeClasses).length === 0) {
      return emptyStateDiv => {
        emptyStateDiv.html('<img class="emptyState" src="img/emptyStates/noNodes.svg"/>');
      };
    }
  }
  async drawReadyState (content) {
    const bounds = this.getContentBounds(content);
    const networkModel = await this.location.getFlatGraphSchema();
    const graph = this.deriveGraphFromNetworkModel(networkModel);

    let edgeLayer = content.select('.edgeLayer');
    if (!edgeLayer.node()) {
      edgeLayer = content.append('g').classed('edgeLayer', true);
    }
    let nodeLayer = content.select('.nodeLayer');
    if (!nodeLayer.node()) {
      nodeLayer = content.append('g').classed('nodeLayer', true);
    }

    let nodeScale = d3.scaleSqrt()
      .domain([0, d3.max(d3.values(networkModel.nodeClasses), d => d.count)])
      .range([MIN_NODE_SIZE, MAX_NODE_SIZE]);
    let nodes = nodeLayer.selectAll('.node')
      .data(d3.entries(networkModel.nodeClasses), d => d.key);
    nodes.exit().remove();
    let nodesEnter = nodes.enter().append('g')
      .classed('node', true);
    nodes = nodes.merge(nodesEnter);
    nodesEnter.append('circle');
    nodes.select('circle').attr('r', d => {
      return nodeScale(d.value.count);
    });

    let edges = edgeLayer.selectAll('.edge')
      .data(d3.entries(networkModel.edgeClasses), d => d.key);
    edges.exit().remove();
    let edgesEnter = edges.enter().append('g')
      .classed('edge', true);
    edges = edges.merge(edgesEnter);
    edgesEnter.append('path');

    const hover = function (d) {
      window.mainView.showTooltip({
        content: d.key,
        targetBounds: this.getBoundingClientRect()
      });
      d3.select(this).classed('hovered', true);
    };
    const unhover = function () {
      window.mainView.hideTooltip();
      d3.select(this).classed('hovered', false);
    };
    const click = async d => {
      window.mainView.setUserSelection(await this.location.filter({
        className: d.key
      }));
    };
    nodes.on('mouseover', hover);
    edges.on('mouseover', hover);
    nodes.on('mouseout', unhover);
    edges.on('mouseout', unhover);
    nodes.on('click', click);
    edges.on('click', click);

    this.simulation.force('collide')
      .radius(d => {
        return nodeScale(d.entity.count);
      });
    this.simulation.force('center')
      .x(bounds.width / 2)
      .y(bounds.height / 2);
    this.simulation.nodes(graph.nodes);
    this.simulation.force('link')
      .links(graph.links);
    this.simulation.on('tick', () => {
      nodes.attr('transform', d => {
        const node = graph.nodes[graph.nodeLookup['node' + d.key]];
        return `translate(${node.x},${node.y})`;
      });
      edges.select('path').attr('d', d => {
        let links = graph.linkLookup['edge' + d.key];
        return this.computeHyperedgePath({
          edge: graph.nodes[graph.nodeLookup['edge' + d.key]],
          sourceLinks: links.sources.map(i => graph.links[i]),
          targetLinks: links.targets.map(i => graph.links[i]),
          undirecteds: links.undirecteds.map(i => graph.links[i])
        });
      });
    });
    // this.simulation.restart();
  }
  computeHyperedgePath ({ edge, sourceLinks, targetLinks, undirecteds }) {
    let sourceX = 0;
    let sourceY = 0;
    let targetX = 0;
    let targetY = 0;
    sourceLinks.forEach(d => {
      sourceX += d.target.x - d.source.x;
      sourceY += d.target.y - d.source.y;
    });
    const thetaIn = Math.atan2(sourceY, sourceX);
    targetLinks.forEach(d => {
      targetX += d.target.x - d.source.x;
      targetY += d.target.y - d.source.y;
    });
    const thetaOut = Math.atan2(targetY, targetX);
    const theta = (thetaIn + thetaOut) / 2;
    const anchorOffset = {
      x: MAX_NODE_SIZE * Math.cos(theta),
      y: MAX_NODE_SIZE * Math.sin(theta)
    };
    let sourceSegments = sourceLinks.map(d => `\
M${d.source.x},${d.source.y}\
Q${d.target.x - anchorOffset.x},${d.target.y - anchorOffset.y},
${d.target.x},${d.target.y}`);
    return sourceSegments + targetLinks.map(d => `\
M${d.source.x},${d.source.y}\
Q${d.source.x + anchorOffset.x},${d.source.y + anchorOffset.y},
${d.target.x},${d.target.y}`);
  }
  computeTempHyperedgePath ({ edge, sourceLinks, targetLinks, undirecteds }) {
    return sourceLinks.concat(targetLinks).map(d => `\
M${d.source.x},${d.source.y}\
L${d.target.x},${d.target.y}`);
  }
  deriveGraphFromNetworkModel (networkModel) {
    let graph = {
      nodes: [],
      nodeLookup: {},
      links: [],
      linkLookup: {}
    };
    Object.entries(networkModel.nodeClasses).forEach(([nodeClassName, pseudoItem]) => {
      graph.nodeLookup['node' + nodeClassName] = graph.nodes.length;
      graph.nodes.push({
        id: 'node' + nodeClassName,
        entity: pseudoItem
      });
    });
    Object.entries(networkModel.edgeClasses).forEach(([edgeClassName, pseudoItem]) => {
      graph.nodeLookup['edge' + edgeClassName] = graph.nodes.length;
      graph.nodes.push({
        id: 'edge' + edgeClassName,
        entity: pseudoItem
      });
      graph.linkLookup['edge' + edgeClassName] = graph.linkLookup['edge' + edgeClassName] || {
        sources: [],
        targets: [],
        undirecteds: []
      };
      Object.entries(pseudoItem.$nodes).forEach(([nodeClassName, directions]) => {
        Object.entries(directions).forEach(([direction, count]) => {
          if (direction === 'source') {
            graph.linkLookup['edge' + edgeClassName].sources.push(graph.links.length);
            graph.links.push({
              source: 'node' + nodeClassName,
              target: 'edge' + edgeClassName,
              directed: true,
              count
            });
          } else if (direction === 'target') {
            graph.linkLookup['edge' + edgeClassName].targets.push(graph.links.length);
            graph.links.push({
              source: 'edge' + edgeClassName,
              target: 'node' + nodeClassName,
              directed: true,
              count
            });
          } else { // if (direction === 'undirected') {
            graph.linkLookup['edge' + edgeClassName].undirecteds.push(graph.links.length);
            graph.links.push({
              source: 'edge' + edgeClassName,
              target: 'node' + nodeClassName,
              directed: false,
              count
            });
          }
        });
      });
    });
    return graph;
  }
}
NetworkModelView.icon = 'img/networkModel.svg';
NetworkModelView.label = 'Network Model';
export default NetworkModelView;
