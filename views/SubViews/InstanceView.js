/* globals d3 */
import GoldenLayoutView from './GoldenLayoutView.js';
import ZoomableSvgViewMixin from './ZoomableSvgViewMixin.js';

const NODE_SIZE = 7;

class InstanceView extends ZoomableSvgViewMixin(GoldenLayoutView) {
  constructor ({ container, state }) {
    super({
      container,
      icon: InstanceView.icon,
      label: InstanceView.label,
      state
    });
  }
  isEmpty () {
    return window.mainView.instances && window.mainView.instances.length === 0;
  }
  setup () {
    super.setup();
    this.content.append('g')
      .classed('edgeLayer', true);
    this.content.append('g')
      .classed('nodeLayer', true);
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink()) // .distance(50)) //.id(d => d.id))
      .force('charge', d3.forceManyBody())
      .force('center', d3.forceCenter())
      .force('collide', d3.forceCollide().radius(NODE_SIZE));
    window.mainView.instanceGraph.on('update', () => {
      this.simulation.alpha(0.3).restart();
      this.render();
    });
  }
  draw () {
    super.draw();
    const bounds = this.getContentBounds(this.content);

    let nodes = this.content.select('.nodeLayer')
      .selectAll('.node').data(window.mainView.instanceGraph.nodes);
    nodes.exit().remove();
    const nodesEnter = nodes.enter().append('g')
      .classed('node', true);
    nodes = nodes.merge(nodesEnter);

    nodesEnter.append('circle')
      .attr('r', NODE_SIZE);
    nodes.select('circle')
      .attr('fill', d => d.nodeInstance && d.nodeInstance.classObj.annotations.color
        ? '#' + d.nodeInstance.classObj.annotations.color : '#BDBDBD');
    nodes.classed('highlighted', d => d.nodeInstance &&
      window.mainView.highlightedInstance &&
      window.mainView.highlightedInstance.classObj.classId === d.nodeInstance.classObj.classId &&
      window.mainView.highlightedInstance.index === d.nodeInstance.index);
    nodes.classed('dummy', d => d.dummy)
      .call(d3.drag()
        .on('start', d => {
          if (!d3.event.active) {
            this.simulation.alphaTarget(0.3).restart();
          }
          d.fx = d.x;
          d.fy = d.y;
          // Initiate linked highlighting
          if (d.nodeInstance) {
            window.mainView.highlightInstance(d.nodeInstance, this);
          } else {
            window.mainView.clearHighlightInstance();
          }
        }).on('drag', d => {
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        }).on('end', d => {
          if (!d3.event.active) {
            this.simulation.alphaTarget(0);
          }
          delete d.fx;
          delete d.fy;
          // Clear the highlighted row in the table
          // window.mainView.clearHighlightInstance();
        }));

    let edges = this.content.select('.edgeLayer')
      .selectAll('.edge').data(window.mainView.instanceGraph.edges);
    edges.exit().remove();
    const edgesEnter = edges.enter().append('g')
      .classed('edge', true);
    edges = edges.merge(edgesEnter);

    edgesEnter.append('path')
      .classed('line', true);
    edges.select('.line')
      .attr('stroke', d => d.edgeInstance.classObj.annotations.color
        ? '#' + d.edgeInstance.classObj.annotations.color : '#BDBDBD');
    edges.on('click', d => {
      window.mainView.highlightInstance(d.edgeInstance, this);
    });

    edges.classed('highlighted', d => window.mainView.highlightedInstance &&
      window.mainView.highlightedInstance.classObj.classId === d.edgeInstance.classObj.classId &&
      window.mainView.highlightedInstance.index === d.edgeInstance.index);

    this.simulation.on('tick', () => {
      edges.select('.line')
        .attr('d', d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    this.simulation.nodes(window.mainView.instanceGraph.nodes);
    this.simulation.force('link').links(window.mainView.instanceGraph.edges);
    this.simulation.force('center')
      .x(bounds.width / 2)
      .y(bounds.height / 2);
  }
}
InstanceView.icon = 'img/instanceView.svg';
InstanceView.label = 'Topology Sample';
export default InstanceView;
