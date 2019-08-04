import React, { Component } from 'react'
import Header from '../components/Header'
import HomeForm from "../components/HomeForm";
import HomeUploading from "../components/HomeUploading";
import HomeFormSent from "../components/HomeFormSent";
import _ from 'lodash';

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      componentName: '',
      data: null,
      uploadEvent: null,
    };
    this._renderComponent = this._renderComponent.bind(this)
  }


  _renderComponent() {
    const { componentName, data, uploadEvent } = this.state;
    switch (componentName) {
      case 'HomeUploading':
        return <HomeUploading event={uploadEvent} data={data} />
      case 'HomeUploadSent':
        return <HomeFormSent data={data} />
      default:
        return <HomeForm
          onUploadEvent={(event) => {
            let data = this.state.data;
            if (_.get(event, 'type') === 'success') {
              data = _.get(event, 'payload');
            }
            this.setState(
              {
                data: data,
                uploadEvent: event,
                componentName: (_.get(event, 'type') === 'success') ? 'HomeUploadSent' : this.state.componentName,
              }
            );
          }}
          onUploadBegin={(data) => {
            this.setState({
              data: data,
              componentName: 'HomeUploading',
            });
          }} />
        return
    }
  }
  render() {
    return (
      <div className={'app-container'}>
        <Header />
        <div className={'app-content'}>
          {this._renderComponent()}
        </div>
      </div>
    )
  }
}


export default Home;