import React, { Component } from 'react';
import { imageListLoader, imageConverters, arrayConverters } from 'imutils';
import Header from './Header';
import Icon from './Icon';
import Label from './Label';
import WasmMode from './WasmMode';
import Spinner from './Spinner';
import InfoLabel from './InfoLabel';
import Benchmark from './Benchmark';
import ImageService from '../services/ImageService';

class FaceDetector extends Component {
  state = {
    wasmMode: false,
    loading: false,
    dragging: false,
    draggingTimeout: null,
    info: null,
    infoTimeout: null,
    images: []
  }

  componentDidMount() {
    ImageService.on('message', this.onMessage);
    window.addEventListener('dragover', this.onDragOver);
    window.addEventListener('drop', this.onDrop);

    if (!this.props.serviceLoaded) {
      this.setState({ info: 'Loading OpenCv...' });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.serviceLoaded && !prevProps.serviceLoaded) {
      const message = this.props.serviceError || 'Finished loading OpenCv';
      this.displayInfoLabel(message);
    }
  }

  componentWillUnmount() {
    ImageService.removeListener('message', this.onMessage);
    window.clearTimeout(this.state.draggingTimeout);
    window.clearTimeout(this.state.infoTimeout);
    window.removeEventListener('dragover', this.onDragOver);
    window.removeEventListener('drop', this.onDrop);
  }

  onMessage = ({ data }) => {
    if (data.result) {
      const images = data.result.map(({ data, ...props }) => ({
        data: arrayConverters.toImage(data),
        ...props
      }))
      this.setState({ images });
    }
    this.displayInfoLabel(data.info);
    this.setState({ loading: false });
  }

  onDragOver = ev => {
    ev.preventDefault();
    window.clearTimeout(this.state.draggingTimeout);
    const draggingTimeout = window.setTimeout(() => {
      this.setState({ dragging: false })
    }, 100)
    this.setState({ dragging: true, draggingTimeout });
  }

  onDrop = ev => {
    ev.preventDefault();
    this.setState({ loading: true });
    this.loadImages(ev.target.files || ev.dataTransfer.files);
  }

  loadImages = async fileList => {
    const newImages = await imageListLoader(fileList, () => {
      this.displayInfoLabel('File is not an image, skipping')
    })
    const images = [...this.state.images, ...newImages];
    this.setState({ images, loading: false })
  }

  clearImages = () => {
    if (this.state.loading) {
      return;
    }
    this.setState({ images: [] })
  }

  toggleWasmMode = () => {
    if (this.state.loading) {
      return;
    }
    this.displayInfoLabel(`Now running ${!this.state.wasmMode ? 'WebAssembly' : 'JavaScript' }`)
    this.setState({wasmMode: !this.state.wasmMode});
  }

  displayInfoLabel = info => {
    const infoTimeout = window.setTimeout(this.dismissInfoLabel, 5000);
    window.clearTimeout(this.state.infoTimeout);
    this.setState({ info, infoTimeout });
  }

  dismissInfoLabel = () => {
    this.setState({ info: null })
  }

  onBenchmarkOpen = () => {
    if (!this.props.serviceLoaded) {
      return;
    }
    this.setState({ showBenchmark: true });
  }

  onBenchmarkStart = () => {
    this.setState({ info: 'Running benchmarks..', loading: true  });
  }

  onBenchmarkStop = () => {
    this.dismissInfoLabel();
    this.setState({ showBenchmark: true, loading: false });
  }

  onBenchmarkClose = () => {
    this.setState({ showBenchmark: false });
  };

  runFaceDetection = async () => {
    if (this.state.loading || !this.props.serviceLoaded) {
      return;
    }
    if (this.state.images.length) {
      this.setState({ loading: true });
      const images = await imageConverters.mapToUint8ClampedArray([...this.state.images]);
      ImageService.postMessage({
        action: this.state.wasmMode? 'containsFaceWasm' : 'containsFaceJs',
        images
      })
    } else {
      this.displayInfoLabel('Upload some images first');
    }
  }

  render() {
    const images = this.state.images.map((image) => {
      return (
        <div class="uploaded-image">
         {image.faceDetected ? <span><Icon name="check" size="xs"/></span> : null }
          <img 
            src={image.data}
            alt="uploaded"
            className={image.faceDetected ? 'contains-face' : ''}
            key={image.id}
          />
        </div>
      )
    })

    return (
      <div className="component-wrapper">
        <Header title="Face Detector">
          <Label
            text="Benchmark"
            className="benchmark-label"
            icon={<Icon name="benchmark" size="xs"/>}
            onClick={this.onBenchmarkOpen}
            title="Run benchmark"
          />
          <WasmMode wasmMode={this.state.wasmMode} onClick={this.toggleWasmMode} />
          <div className="toolbar">
            <Spinner visible={this.state.loading || !this.props.serviceLoaded} color="#A599FF" />
            <Label
              icon={<Icon name="close" size="s"/>}
              size="square"
              className="toolbar-button"
              onClick={this.clearImages}
              title="Clear uploaded images"
            />
            <Label
              text="Detect Faces"
              size="large"
              className="toolbar-button"
              onClick={this.runFaceDetection}
              title="Detect Faces"
            />
          </div>
        </Header>
        <div className="component-content image-container">
          <Benchmark
            title="Face Detector"
            benchmarkType="faceDetectorBenchmark"
            isOpen={this.state.showBenchmark}
            onClose={this.onBenchmarkClose}
            onStart={this.onBenchmarkStart}
            onStop={this.onBenchmarkStop}
            tasks={[
              'jsFaceDetection',
              'wasmFaceDetection',
              'getResults'
            ]}
          />
          { images }
          <div className={`drop-info ${this.state.images.length ? 'drop-info-hidden' : ''}`} onClick={() => this.input.click()}>
            <Icon name={this.state.dragging ? 'drop' : 'drag'} size={this.state.dragging ? 'xl' : 'l'} />
            <span>Drop images here (or click to choose a file)</span>
            <input type="file" className="hidden" ref={(input) => this.input = input} multiple onChange={this.onDrop} />
          </div>
          <InfoLabel text={this.state.info} onClick={this.dismissInfoLabel} />
        </div>
      </div>
    );
  }
}

export default FaceDetector;
